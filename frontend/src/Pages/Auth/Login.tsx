import LoginForm from '@/Components/forms/LoginForm';
import { INIT_KRATOS_LOGIN_FLOW } from '@/common';
import { useNavigate } from 'react-router-dom';

export default function Login() {
    const navigate = useNavigate();
    if (!window.location.search.includes('flow')) {
        navigate(INIT_KRATOS_LOGIN_FLOW);
    }
    return (
        <div title="Log in">
            <LoginForm />
        </div>
    );
}
