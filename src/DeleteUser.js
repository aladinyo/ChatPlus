import { Backdrop, Avatar, Button } from '@mui/material';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { useStateValue } from './StateProvider';
import "./DeleteUser.css";
import { useCallback, useEffect, useRef, useState } from 'react';
import { useHistory } from "react-router-dom";
import db, { db2, auth } from './firebase';
//import { createPortal } from 'react-dom';

async function wait(time, fn) {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(fn && fn())
        }, time)
    });
}

const DeleteUser = ({ openDelete, setOpenDelete, setLoader }) => {
    const [{ user }, dispatch, actionTypes] = useStateValue();
    const history = useHistory();
    const unblock = useRef(null);
    const [oneClick, setOneClick] = useState(false);
    //const [open, setOpen] = useState(false);

    /*useEffect(() => {
        console.log("animState of deleteUser is: ", animState);
        if (animState === "entering" || animState === "entered") {
            setOpen(true);
        } else if (animState === "exiting") {
            setOpen(false);
        }
    }, [animState]);*/

    //wait(5000, () => console.log("waited 5 seconds"))

    const logOut = useCallback(async () => {
        history.replace("/chats")
        const promises = [];
        promises.push(db2.ref().child("/status/" + user.uid).update({
            state: "offline"
        }));
        promises.push(db2.ref('.info/connected').off("value", undefined));
        console.log("connection off with database: ");
        await Promise.all(promises);
        await auth.signOut();
        console.log("signed out")
    }, [user, history])

    const deleteUser = useCallback(async () => {
        setOneClick(true)
        console.log("deleting user account");
        await wait(225);
        console.log("user", user);
        db2.ref().child("/status/" + user.uid).update({
            state: "offline"
        });
        db2.ref('.info/connected').off("value");
        db.collection("users").doc(user.uid).set({
            delete: true
        }, { merge: true });
        setOpenDelete(false);
       db.collection("users").doc(user.uid).onSnapshot(doc => {
            if (!doc.data()) {
                dispatch({ type: actionTypes.SET_USER, user: null });
                setLoader(false);
                console.log("user was deleted");
            }
        });
        await wait(225);
        setLoader(true);
        /*await wait(2000);
        dispatch({ type: actionTypes.SET_USER, user: null });
        setLoader(false);*/
    }, [user]);

    useEffect(() => {
        if (openDelete) {
            console.log("delete user mounted and navigation blocked")
            unblock.current = history.block(() => {
                console.log("history blocked navigation")
                return false;
            });
        } else {
            console.log("navigation is back");
            unblock.current && unblock.current();
        }

        return () => {
            !openDelete && setOneClick(false);
        }
    }, [openDelete]);

    return (
        <Backdrop
            open={openDelete}
        >
            <div className="delete__user--container">
                <div className="delete__avatar--container">
                    <Avatar src={user?.photoURL} />
                    <div className="warning__container">
                        <WarningAmberRoundedIcon />
                    </div>
                </div>
                <h2>Delete Your Account?</h2>
                <p>We're sad to see you go!<br />
                    You will lose all your data if you delete your account and it cannot be undone<br />
                    Are you absolutely sure you want to proceed?</p>
                <div className="delete__buttons">
                    <Button onClick={() => !oneClick ? wait(225, () => setOpenDelete(false)) && setOneClick(true) : null}>
                        No! I've changed my mind
                    </Button>
                    <Button onClick={!oneClick ? deleteUser : null}>
                        Delete my Account
                    </Button>
                </div>
            </div>
        </Backdrop>
    );
}

export default DeleteUser;