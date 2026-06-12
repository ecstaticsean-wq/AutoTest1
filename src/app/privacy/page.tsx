export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-slate-900 to-slate-950 text-white px-6 py-16">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">개인정보처리방침</h1>
        <p className="text-slate-300">
          딸깍 쓰레드(이하 &quot;서비스&quot;)는 이용자의 개인정보를 중요하게 생각하며,
          관련 법령을 준수합니다.
        </p>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">1. 수집하는 정보</h2>
          <p className="text-slate-300">
            서비스 이용을 위해 이메일, 비밀번호(암호화 저장), 연결한 Threads 계정 정보,
            등록한 Gemini API 키(암호화 저장)를 수집합니다.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">2. 정보의 이용 목적</h2>
          <p className="text-slate-300">
            수집된 정보는 회원 인증, Threads 게시물 생성 및 발행, 댓글 자동응답,
            성과 분석 기능 제공을 위해서만 사용됩니다.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">3. 정보의 보관 및 삭제</h2>
          <p className="text-slate-300">
            이용자가 계정을 삭제하거나 Threads 연결을 해제하면 관련 토큰 및 키는
            즉시 삭제됩니다.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">4. 문의</h2>
          <p className="text-slate-300">
            개인정보 관련 문의는 ecstaticsean@gmail.com으로 연락해 주세요.
          </p>
        </section>
      </div>
    </div>
  );
}
