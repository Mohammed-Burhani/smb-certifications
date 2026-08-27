import LoginForm from "./LoginForm";

export const metadata = {
  title: "Sign In | SMB Fittings Certification System",
  description: "Admin login for SMB Fittings IBR document control system",
};

export default function LoginPage() {
  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <p className="eyebrow">SMB FITTINGS / IBR CONTROL</p>
          <h1>Admin Portal</h1>
          <p className="login-subtitle">
            Sign in to access the manufacturing certification library and editor.
          </p>
        </div>

        <LoginForm />

        <div className="login-footer">
          <p>Restricted access. Authorized QC personnel only.</p>
        </div>
      </div>
    </div>
  );
}
