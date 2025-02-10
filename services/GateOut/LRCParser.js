const { Transform } = require('stream');

class LRCParser extends Transform {
    constructor(options) {
        super(options);
        this.buffer = Buffer.alloc(0);
    }

    _transform(chunk, encoding, callback) {
        this.buffer = Buffer.concat([this.buffer, chunk]);

        while (this.buffer.length > 4) { // STX + LEN-H + LEN-L + Resp minimal
            if (this.buffer[0] !== 0x02) {
                this.buffer = this.buffer.slice(1); // Hapus byte invalid sampai STX ditemukan
                continue;
            }

            const lenH = this.buffer[1];
            const lenL = this.buffer[2];
            const resp = this.buffer[3];
            const dataLength = ((lenH << 8) | lenL) - 1;
            const frameSize = 1 + 1 + 1 + 1 + dataLength + 1; // STX + LEN-H + LEN-L + Resp + Data[n] + LRC

            if (this.buffer.length < frameSize) {
                break; // Tunggu lebih banyak data
            }

            const frame = this.buffer.slice(0, frameSize);
            const lrc = frame[frameSize - 1];

            let calculatedLRC = 0;
            for (let i = 1; i < frameSize - 1; i++) {
                calculatedLRC ^= frame[i];
            }

            if (calculatedLRC === lrc) {
                this.push(frame); // Kirim frame yang valid ke event 'data'
            } else {
                console.error('Invalid LRC:', { frame: frame.toString('hex').toUpperCase(), calculatedLRC, lrc });
            }

            this.buffer = this.buffer.slice(frameSize); // Hapus frame yang sudah diproses
        }

        callback();
    }
}

module.exports = LRCParser;
