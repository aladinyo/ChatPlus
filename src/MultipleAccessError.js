import { memo, useCallback } from 'react';
import { Button } from '@mui/material';
import { auth } from './firebase';
import { ReactComponent as ChatPlusLogo } from "./logo.svg"
import bg from "./login-bg.svg"
import './Login.css'

const MultipleAccessError = () => {
    const out = useCallback(() => {
        auth.signOut();
    }, []);

    return (
        <div className="login" style={{ backgroundImage: `url(${bg})` }}>
            <div className="login__container access__container">
                <ChatPlusLogo />
                <div className="login__text access__text">
                    <h1>Multiple Devices Can't Access This App at The Same time</h1>
                    <h3>It looks like you're trying to access your account with another device at the same time, You cannot do that, either log out from the other device and click on reload to reload the page and access this app with the same account or log out from this device and access the app with another account</h3>
                </div>

                <Button onClick={() => window.location.reload()} sx={{
                    marginRight: "10px"
                }}>
                    Reload
                </Button>
                <Button onClick={out} >
                    Log Out
                </Button>
            </div>
        </div>
    )
}

export default memo(MultipleAccessError);