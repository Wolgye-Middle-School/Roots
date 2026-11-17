const os = require('os');
const path = require('path');

// Vercel 등 서버리스 환경은 /tmp 외에는 쓰기가 불가능하다.
// 이 경우 /tmp에 저장하며, 인스턴스가 재시작되면 데이터가 사라진다.
const IS_SERVERLESS = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const ROOT = IS_SERVERLESS ? path.join(os.tmpdir(), 'roots') : path.join(__dirname, '..');

const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(ROOT, 'uploads');

// 저장 경로를 직접 지정하지 않은 서버리스 환경 = 데이터가 유지되지 않음
const EPHEMERAL = IS_SERVERLESS && !process.env.DATA_DIR;

module.exports = { DATA_DIR, UPLOAD_DIR, IS_SERVERLESS, EPHEMERAL };
