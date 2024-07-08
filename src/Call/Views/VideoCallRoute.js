import React from 'react';
import { TransitionGroup, CSSTransition } from "react-transition-group";
import { Route, useLocation } from 'react-router-dom';
import VideoCallView from './VideoCallView';

export default function VideoCallRoute(props) {
    const location = useLocation();

    return (<>
        <TransitionGroup component={null}>
            <CSSTransition
                key={location.pathname}
                timeout={310}
                classNames="page"
            >
                {state => (
                    <Route location={location} path={location.pathname !== "/" ? location.pathname.replace("/call", "") + "/call" : "/call"}>
                        <VideoCallView animState={state} {...props} />
                    </Route>
                )}
            </CSSTransition>
        </TransitionGroup>
    </>)
};