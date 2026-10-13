import { useLocation, Link } from "react-router-dom";
import useDocumentTitle from "../hooks/useDocumentTitle";
import AuthPage from "../components/AuthPage";
import RegisterForm from "../components/RegisterForm";

export default function Register() {
  useDocumentTitle("Create account");

  const location = useLocation();

  return (
    <AuthPage
      title="Create your account"
      footer={
        <>
          Already have an account? <Link to="/login" state={location.state}>Sign in</Link>
        </>
      }
    >
      <RegisterForm />
    </AuthPage>
  );
}
