// 게시판 정의
// writeRoles: 글을 쓸 수 있는 역할 (모두 관리자 승인을 받은 회원이어야 함)
const BOARDS = [
  {
    slug: 'notice',
    name: '공지사항',
    description: '느티나무반의 주요 일정과 안내 사항을 알려드립니다.',
    writeRoles: ['admin', 'teacher'],
  },
  {
    slug: 'intro',
    name: '느티나무반 소개',
    description: '느티나무반의 교육 목표, 선생님, 하루 일과를 소개합니다.',
    writeRoles: ['admin', 'teacher'],
  },
  {
    slug: 'activity',
    name: '학습·활동 공유',
    description: '아이들의 학습 현황과 수업 시간에 진행한 활동을 공유합니다.',
    writeRoles: ['admin', 'teacher'],
  },
  {
    slug: 'community',
    name: '학부모 소통방',
    description: '학부모님들이 서로 경험과 정보를 나누고 공감하는 공간입니다.',
    writeRoles: ['admin', 'teacher', 'parent'],
  },
];

const BY_SLUG = Object.fromEntries(BOARDS.map((b) => [b.slug, b]));

function getBoard(slug) {
  return BY_SLUG[slug] || null;
}

function isApproved(user) {
  return !!user && user.status === 'approved';
}

function canWrite(user, board) {
  return isApproved(user) && board.writeRoles.includes(user.role);
}

// 공개 글은 누구나, 회원 전용 글은 승인된 회원만 열람
function canRead(user, post) {
  return post.visibility === 'public' || isApproved(user);
}

// 작성자 본인 또는 관리자만 수정/삭제
function canManage(user, post) {
  return isApproved(user) && (user.role === 'admin' || user.id === post.user_id);
}

// 상단 고정은 관리자와 교사만
function canPin(user) {
  return isApproved(user) && (user.role === 'admin' || user.role === 'teacher');
}

module.exports = { BOARDS, getBoard, isApproved, canWrite, canRead, canManage, canPin };
