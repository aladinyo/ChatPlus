import React, { memo } from 'react';
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
import "./Button.css"

export default memo(function({onClick}) {
    return (
        <div className="btn greenCamera" onClick={onClick}>
            <VideocamRoundedIcon sx={{color: "white"}} />
        </div>
    );
});