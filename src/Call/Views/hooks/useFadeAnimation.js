import { useState, useEffect, useLayoutEffect } from 'react';
import { fadeAnimation } from "../util";

export default function(ref, timeout, noInitAnimation) {
    const [fade, setFade] = useState(null); 

    useLayoutEffect(() => {
        const x = fadeAnimation(ref.current, timeout)
        setFade(x);
        !noInitAnimation && x.setupFadeAnimation();
    }, []);

    useEffect(() => {
        fade && !noInitAnimation && fade.animateFadeIn();
    }, [fade, noInitAnimation]);

    return fade;
}