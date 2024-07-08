import React, { memo, cloneElement, useMemo } from 'react';

function Btn({ onClick, children, classNames}) {
    const element = useMemo(() => {
        return children ? cloneElement(children, {sx: {color: "white"}}) : null
    }, [children]);

    return (
        <div onClick={onClick} className={`btn blurredBtn ${classNames}`} >
            {element}
        </div>
    )
};

export default memo(Btn);