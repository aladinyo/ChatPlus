import React, { memo } from 'react';
import CallEndRoundedIcon from '@mui/icons-material/CallEndRounded';
import "./Button.css"

export default memo(function({onClick}) {
    return (
        <div onClick={onClick} className="btn redPhone">
            <CallEndRoundedIcon sx={{color: "white"}} />
        </div>
    );
});