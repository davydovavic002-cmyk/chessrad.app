self.onmessage = function(e) {
    const cmd = e.data;
    if (cmd === 'uci') {
        self.postMessage('uciok');
    } else if (typeof cmd === 'string' && cmd.startsWith('position')) {
        self._fen = cmd;
    } else if (cmd === 'go movetime 1000') {
        setTimeout(() => {
            self.postMessage('bestmove e2e4');
        }, 200);
    }
};
