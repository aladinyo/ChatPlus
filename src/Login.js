import { memo } from 'react';
import { Button } from '@mui/material';
import { auth, provider } from './firebase';
import { ReactComponent as ChatPlusLogo } from "./logo.svg"
import bg from "./login-bg.svg"
import './Login.css'

function Login() {
    const signIn = () => {
        setTimeout(() => {
            auth.signInWithRedirect(provider).catch(e => alert(e.message))
        }, 250);
    }

    return (
        <div className="login" style={{ backgroundImage: `url(${bg})` }}>
            <div className="login__container">
                <ChatPlusLogo />
                <div className="login__text">
                    <h1>Welcome to ChatPlus</h1>
                </div>

                <Button onClick={signIn}>
                    Sign in with Google
                </Button>
            </div>
        </div>
    )
}

export default memo(Login)