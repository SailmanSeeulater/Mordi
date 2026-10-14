import { useLocation, Link } from "react-router-dom";
import useDocumentTitle from "../hooks/useDocumentTitle";
import AuthPage from "../components/AuthPage";
import SignInForm from "../components/SignInForm";

export default function Login() {
  useDocumentTitle("Sign in");

  const location = useLocation();
  // Handed over by the reset page: "your password has been changed".
  const notice = location.state?.notice;

  return (
    <AuthPage
      title="Sign in"
      footer={
        <>
          New to Mordi? <Link to="/register" state={location.state}>Create an account</Link>
        </>
      }
    >
      <SignInForm notice={notice} />
    </AuthPage>
  );
}
