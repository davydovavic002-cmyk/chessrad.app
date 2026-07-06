import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket } from '../socket';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import '../styles/study-video.css';

const ICE = [{ urls: 'stun:stun.l.google.com:19302' }];

export default function StudyVideoRoom({ roomCode, teacherId, layout = 'inline' }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const localVideoRef = useRef(null);
  const peersRef = useRef(new Map());
  const localStreamRef = useRef(null);
  const [enabled, setEnabled] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [error, setError] = useState('');
  const isTeacher = Number(teacherId) === Number(user.id);

  const syncRemote = useCallback(() => {
    const list = [];
    peersRef.current.forEach((entry, uid) => {
      if (entry.stream) list.push({ userId: uid, username: entry.username, stream: entry.stream });
    });
    setRemoteStreams(list);
  }, []);

  const closePeer = useCallback(
    (uid) => {
      const p = peersRef.current.get(uid);
      if (p) {
        p.pc?.close();
        peersRef.current.delete(uid);
        syncRemote();
      }
    },
    [syncRemote]
  );

  const createPeer = useCallback(
    async (targetUserId, targetUsername, initiator) => {
      if (peersRef.current.has(targetUserId)) return peersRef.current.get(targetUserId).pc;
      const pc = new RTCPeerConnection({ iceServers: ICE });
      peersRef.current.set(targetUserId, { pc, username: targetUsername, stream: null });

      localStreamRef.current?.getTracks().forEach((tr) => pc.addTrack(tr, localStreamRef.current));

      pc.ontrack = (ev) => {
        const entry = peersRef.current.get(targetUserId);
        if (entry) {
          entry.stream = ev.streams[0];
          syncRemote();
        }
      };

      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          getSocket().emit('video:signal', {
            roomCode,
            targetUserId,
            data: { type: 'ice', candidate: ev.candidate },
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') closePeer(targetUserId);
      };

      if (initiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        getSocket().emit('video:signal', {
          roomCode,
          targetUserId,
          data: { type: 'offer', sdp: offer },
        });
      }

      return pc;
    },
    [roomCode, closePeer, syncRemote]
  );

  const handleSignal = useCallback(
    async ({ fromUserId, fromUsername, data }) => {
      if (!enabled || Number(fromUserId) === Number(user.id)) return;

      if (layout === 'group') {
        if (!isTeacher && Number(fromUserId) !== Number(teacherId)) return;
      } else if (isTeacher || Number(fromUserId) === Number(teacherId)) {
        /* duo: teacher ↔ student */
      } else if (!isTeacher) {
        return;
      }

      let entry = peersRef.current.get(fromUserId);
      if (!entry) {
        await createPeer(fromUserId, fromUsername, false);
        entry = peersRef.current.get(fromUserId);
      }
      const pc = entry?.pc;
      if (!pc) return;

      if (data.type === 'offer') {
        await pc.setRemoteDescription(data.sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        getSocket().emit('video:signal', {
          roomCode,
          targetUserId: fromUserId,
          data: { type: 'answer', sdp: answer },
        });
      } else if (data.type === 'answer') {
        await pc.setRemoteDescription(data.sdp);
      } else if (data.type === 'ice' && data.candidate) {
        try {
          await pc.addIceCandidate(data.candidate);
        } catch {
          /* ignore stale ice */
        }
      }
    },
    [enabled, user.id, isTeacher, teacherId, roomCode, createPeer, layout]
  );

  const connectToPeer = useCallback(
    (peer) => {
      if (Number(peer.userId) === Number(user.id)) return;
      if (layout === 'group') {
        if (!isTeacher && Number(peer.userId) !== Number(teacherId)) return;
        if (isTeacher && Number(peer.userId) === Number(teacherId)) return;
      } else {
        if (!isTeacher && Number(peer.userId) !== Number(teacherId)) return;
        if (isTeacher && Number(peer.userId) === Number(teacherId)) return;
      }
      createPeer(peer.userId, peer.username, true);
    },
    [user.id, isTeacher, teacherId, createPeer, layout]
  );

  useEffect(() => {
    if (!roomCode || !enabled) return;
    const socket = getSocket();

    const onPeers = ({ peers }) => {
      (peers || []).forEach((p) => connectToPeer(p));
    };
    const onJoined = ({ userId, username }) => {
      connectToPeer({ userId, username });
    };
    const onLeft = ({ userId }) => closePeer(userId);
    const onSignal = (payload) => handleSignal(payload);

    socket.emit('video:join', { roomCode, teacherId: Number(teacherId) });
    socket.on('video:peers', onPeers);
    socket.on('video:joined', onJoined);
    socket.on('video:left', onLeft);
    socket.on('video:signal', onSignal);

    return () => {
      socket.emit('video:leave', { roomCode });
      socket.off('video:peers', onPeers);
      socket.off('video:joined', onJoined);
      socket.off('video:left', onLeft);
      socket.off('video:signal', onSignal);
      peersRef.current.forEach((_, uid) => closePeer(uid));
    };
  }, [roomCode, enabled, teacherId, connectToPeer, closePeer, handleSignal]);

  async function toggleVideo() {
    if (enabled) {
      localStreamRef.current?.getTracks().forEach((tr) => tr.stop());
      localStreamRef.current = null;
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      peersRef.current.forEach((_, uid) => closePeer(uid));
      setEnabled(false);
      getSocket().emit('video:leave', { roomCode });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setEnabled(true);
      setError('');
      getSocket().emit('video:join', { roomCode, teacherId: Number(teacherId) });
    } catch {
      setError(t('video_permission_denied'));
    }
  }

  const showDuoPlaceholder = layout === 'sidebar' && enabled && remoteStreams.length === 0;
  const remoteLabel = isTeacher ? t('video_student') : t('video_teacher');

  return (
    <div className={`study-video-room study-video-room--${layout}`}>
      <div className="study-video-head">
        <span>{t('video_in_class')}</span>
        <button type="button" className={`btn btn-sm${enabled ? ' btn-danger' : ' btn-primary'}`} onClick={toggleVideo}>
          {enabled ? t('video_stop') : t('video_start')}
        </button>
      </div>
      {error && <p className="study-video-error">{error}</p>}
      <div className="study-video-grid">
        <div className={`study-video-tile${enabled ? '' : ' study-video-tile--off'}`}>
          <video ref={localVideoRef} autoPlay muted playsInline />
          <span>{user.username} {t('video_you')}</span>
        </div>

        {layout === 'sidebar' && showDuoPlaceholder && (
          <div className="study-video-tile study-video-tile--placeholder">
            <span>{t('video_waiting')}</span>
          </div>
        )}

        {remoteStreams.map((r) => (
          <div key={r.userId} className="study-video-tile">
            <video
              autoPlay
              playsInline
              ref={(el) => {
                if (el && r.stream) el.srcObject = r.stream;
              }}
            />
            <span>{r.username}</span>
          </div>
        ))}

        {layout === 'sidebar' && !enabled && (
          <div className="study-video-tile study-video-tile--placeholder">
            <span>{remoteLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
}
