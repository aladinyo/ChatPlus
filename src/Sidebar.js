import { useEffect, useState, memo, useRef, useMemo, useCallback } from 'react';
import SidebarChat from './SidebarChat';
import { Avatar, IconButton } from '@mui/material';
import { Message, PeopleAlt, Home, ExitToApp as LogOut, SearchOutlined, GetAppRounded, Add, /*CookieSharp*/ } from '@mui/icons-material';
import db, { auth, createTimestamp, db2 } from "./firebase";
import { useStateValue } from './StateProvider';
import { NavLink, Route, useHistory, Switch, Link as NormalLink } from 'react-router-dom';
import algoliasearch from "algoliasearch";
import { algoliaKeys } from './configKeys';
import './Sidebar.css';
import DeleteIcon from '@mui/icons-material/Delete';
import audio from './notification.mp3'
//import { disconnectRef } from './setOnlineStatus';

const index = algoliasearch(algoliaKeys.appKey, algoliaKeys.publicSearchKey).initIndex(algoliaKeys.index);
/*
function search(user, searchInput, page, history, setSearchList, menu) {
    if (searchInput !== "") {
        document.querySelector(".sidebar__search input").blur();
        if (page.width <= 760) {
            history.push("/search?" + searchInput);
        };
        setSearchList(null);
        if (menu !== 4) {
            setMenu(4)
        };
        index.search(searchInput).then(res => {
            const result = res.hits.map(cur => cur.objectID !== user.uid ? {
                ...cur,
                id: cur.photoURL ? cur.objectID > user.uid ? cur.objectID + user.uid : user.uid + cur.objectID : cur.objectID,
                userID: cur.photoURL ? cur.objectID : null
            } : null);
            setSearchList(result);
        });
    };
}*/

function Sidebar({ chats, pwa, rooms, fetchRooms, users, fetchUsers, mounted, setMounted, /*deletePath,*/ setOpenDelete, notification }) {
    const [searchList, setSearchList] = useState(null);
    const [searchInput, setSearchInput] = useState("");
    const [menu, setMenu] = useState(1);
    const [{ user, page, pathID, /*path*/ }] = useStateValue();
    let history = useHistory();
    const prevUnreadMessages = useRef((() => {
        const data = {};
        chats.forEach(cur => cur.unreadMessages || cur.unreadMessages === 0 ? data[cur.id] = cur.unreadMessages : null);
        return data;
    })());
    //const typingTimeout = useRef(null);

    const Nav = useMemo(() => {
        if (page?.width > 760) {
            return props =>
                <div className={`${props.classSelected ? "sidebar__menu--selected" : ""}`} onClick={props.click}>
                    {props.children}
                </div>
        }
        return NavLink;
    }, [page]);

    const search = useCallback(function search(e) {
        e.preventDefault();
        if (searchInput !== "") {
            document.querySelector(".sidebar__search input").blur();
            if (page.width <= 760) {
                history.push("/search?" + searchInput);
            };
            setSearchList(null);
            if (menu !== 4) {
                setMenu(4)
            };
            index.search(searchInput).then(res => {
                const result = res.hits.map(cur => cur.objectID !== user.uid && cur.name ? {
                    ...cur,
                    id: cur.photoURL ? cur.objectID > user.uid ? cur.objectID + user.uid : user.uid + cur.objectID : cur.objectID,
                    userID: cur.photoURL ? cur.objectID : null
                } : null);
                console.log("serach result: ", result);
                setSearchList(result);
            }).catch(e => console.log("search error: ", e));
        };
        return false;
    }, [page, menu, searchInput]);

    const createChat = useCallback(() => {
        const roomName = prompt("Type the name of your room");
        if (roomName) {
            db.collection("rooms").add({
                name: roomName,
                timestamp: createTimestamp(),
                lastMessage: "",
            });
        };
    }, []);

    const logOut = useCallback(() => {
        async function out() {
            history.replace("/chats")
            const promises = [];
            promises.push(db.doc('/users/' + user.uid).set({ state: "offline" }, { merge: true }));
            promises.push(db2.ref().child("/status/" + user.uid).update({
                state: "offline"
            }));
            promises.push(db2.ref('.info/connected').off("value", undefined));
            console.log("connection off with database: ");
            await Promise.all(promises);
            await auth.signOut();
            console.log("signed out")
        }
        out();
    }, [user, history])

    useEffect(() => {
        function unlockAudio() {
            const sound = new Audio(audio);

            sound.play();
            sound.pause();
            sound.currentTime = 0;

            document.body.removeEventListener('click', unlockAudio)
            document.body.removeEventListener('touchstart', unlockAudio)
        }
        document.body.addEventListener('click', unlockAudio);
        document.body.addEventListener('touchstart', unlockAudio);
    }, []);

    useEffect(() => {
        const data = {};
        chats.forEach(cur => {
            if (cur.unreadMessages || cur.unreadMessages === 0) {
                if ((cur.unreadMessages > prevUnreadMessages.current[cur.id] || !prevUnreadMessages.current[cur.id] && prevUnreadMessages.current[cur.id] !== 0) && pathID !== cur.id) {
                    notification.current.play();
                };
                data[cur.id] = cur.unreadMessages;
            };
        });
        prevUnreadMessages.current = data;
    }, [chats, pathID]);

    useEffect(() => {
        if (page.initial && page.width < page.height && chats && !mounted) {
            setMounted(true);
        };
    }, [chats, mounted, page]);

    /*location => location.pathname === "/" ? "/delete" : location.pathname.replace("/delete", "") + "/delete" */

    return (
        <div className="sidebar" style={{
            minHeight: page.width <= 760 ? page.height : "auto"
        }}>
            <div className="sidebar__header">
                <div className="sidebar__header--left">
                    <Avatar src={user?.photoURL} />
                    <h4>{user?.displayName} </h4>
                </div>
                <div className="sidebar__header--right">
                    <IconButton onClick={() => setOpenDelete(true)}>
                        <DeleteIcon />
                    </IconButton>
                    <IconButton onClick={() => {
                        if (pwa) {
                            console.log("prompting the pwa event")
                            pwa.prompt()
                        } else {
                            console.log("pwa event is undefined")
                        }
                    }} >
                        <GetAppRounded />
                    </IconButton>
                    <IconButton onClick={logOut} >
                        <LogOut />
                    </IconButton>

                </div>
            </div>

            <div className="sidebar__search">
                <form
                    className="sidebar__search--container"
                    onSubmit={e => search(e)}
                >
                    <SearchOutlined />
                    <input
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Search for users or rooms"
                        type="text"
                    />
                    <button style={{ display: "none" }} type="submit"></button>
                </form>
            </div>

            <div className="sidebar__menu">
                <Nav
                    classSelected={menu === 1 ? true : false}
                    to="/chats"
                    click={() => setMenu(1)}
                    activeClassName="sidebar__menu--selected"
                >
                    <div className="sidebar__menu--home">
                        <Home />
                    </div>
                </Nav>
                <Nav
                    classSelected={menu === 2 ? true : false}
                    to="/rooms"
                    click={() => setMenu(2)}
                    activeClassName="sidebar__menu--selected"
                >
                    <div className="sidebar__menu--rooms">
                        <Message />
                    </div>
                </Nav>
                <Nav
                    classSelected={menu === 3 ? true : false}
                    to="/users"
                    click={() => setMenu(3)}
                    activeClassName="sidebar__menu--selected"
                >
                    <div className="sidebar__menu--users">
                        <PeopleAlt />
                    </div>
                </Nav>
            </div>

            {page.width <= 760 ?
                <>
                    <Switch>
                        <Route path="/users" >
                            <SidebarChat key="users" fetchList={fetchUsers} dataList={users} title="Users" path="/users" />
                        </Route>
                        <Route path="/rooms" >
                            <SidebarChat key="rooms" fetchList={fetchRooms} dataList={rooms} title="Rooms" path="/rooms" />
                        </Route>
                        <Route path="/search">
                            <SidebarChat key="search" dataList={searchList} title="Search Result" path="/search" />
                        </Route>
                        <Route path="/chats" >
                            <SidebarChat key="chats" dataList={chats} title="Chats" path="/chats" />
                        </Route>
                    </Switch>
                </>
                :
                menu === 1 ?
                    <SidebarChat key="chats" dataList={chats} title="Chats" />
                    : menu === 2 ?
                        <SidebarChat key="rooms" fetchList={fetchRooms} dataList={rooms} title="Rooms" />
                        : menu === 3 ?
                            <SidebarChat key="users" fetchList={fetchUsers} dataList={users} title="Users" />
                            : menu === 4 ?
                                <SidebarChat key="search" dataList={searchList} title="Search Result" />
                                : null
            }
            <div className="sidebar__chat--addRoom" onClick={createChat}>
                <IconButton >
                    <Add />
                </IconButton>
            </div>
        </div>
    );
};

export default memo(Sidebar);