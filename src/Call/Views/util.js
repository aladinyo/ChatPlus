export function dragElement(elmnt, page) {
    var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0, top, left, prevTop = 0, prevLeft = 0, x, y, maxTop, maxLeft;
    const widthRatio = page.width / window.innerWidth;
    const heightRatio = page.height / window.innerHeight;
    //clear element's mouse listeners
    closeDragElement();
    // setthe listener
    elmnt.addEventListener("mousedown", dragMouseDown);
    elmnt.addEventListener("touchstart", dragMouseDown, { passive: false });

    function dragMouseDown(e) {
        e = e || window.event;
        // get the mouse cursor position at startup:
        if (e.type === "touchstart") {
            if (typeof(e.target.className) === "string") {
                if (!e.target.className.includes("btn")) {
                    e.preventDefault();
                }
            } else if (!typeof(e.target.className) === "function") {
                e.stopPropagation();
            }
            pos3 = e.touches[0].clientX * widthRatio;
            pos4 = e.touches[0].clientY * heightRatio;
        } else {
            e.preventDefault();
            pos3 = e.clientX * widthRatio;
            pos4 = e.clientY * heightRatio;
        };
        maxTop = elmnt.offsetParent.offsetHeight - elmnt.offsetHeight;
        maxLeft = elmnt.offsetParent.offsetWidth - elmnt.offsetWidth;
        document.addEventListener("mouseup", closeDragElement);
        document.addEventListener("touchend", closeDragElement, { passive: false });
        // call a function whenever the cursor moves:
        document.addEventListener("mousemove", elementDrag);
        document.addEventListener("touchmove", elementDrag, { passive: false });
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        // calculate the new cursor position:
        if (e.type === "touchmove") {
            x = e.touches[0].clientX * widthRatio;
            y = e.touches[0].clientY * heightRatio;
        } else {
            e.preventDefault();
            x = e.clientX * widthRatio;
            y = e.clientY * heightRatio;
        };
        pos1 = pos3 - x;
        pos2 = pos4 - y;
        pos3 = x
        pos4 = y;
        // set the element's new position:
        top = elmnt.offsetTop - pos2;
        left = elmnt.offsetLeft - pos1;
        //prevent the element from overflowing the viewport
        if (top >= 0 && top <= maxTop) {
            elmnt.style.top = top + "px";
        } else if ((top > maxTop && pos4 < prevTop) || (top < 0 && pos4 > prevTop)) {
            elmnt.style.top = top + "px";
        };
        if (left >= 0 && left <= maxLeft) {
            elmnt.style.left = left + "px";
        } else if ((left > maxLeft && pos3 < prevLeft) || (left < 0 && pos3 > prevLeft)) {
            elmnt.style.left = left + "px";
        };
        prevTop = y; prevLeft = x;
    }

    function closeDragElement() {
        // stop moving when mouse button is released:
        document.removeEventListener("mouseup", closeDragElement);
        document.removeEventListener("touchend", closeDragElement);
        document.removeEventListener("mousemove", elementDrag);
        document.removeEventListener("touchmove", elementDrag);
    };

    return function() {
        elmnt.removeEventListener("mousedown", dragMouseDown);
        elmnt.removeEventListener("touchstart", dragMouseDown);
        closeDragElement();
    };
};

export async function wait(timeout) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, timeout);
    });
};

export function fadeAnimation(element, timeout) {
    const transition = `opacity ${timeout}ms cubic-bezier(0.37, 0, 0.63, 1), transform ${timeout}ms cubic-bezier(0.37, 0, 0.63, 1), width ${timeout}ms cubic-bezier(0.37, 0, 0.63, 1), height ${timeout}ms cubic-bezier(0.37, 0, 0.63, 1)`;
    return {
        setupFadeAnimation: function () {
            element.style.opacity = "0";
            element.style.transform = "scale(0.8)";
            element.style.transition = transition;
        },
        animateFadeIn: async function () {
            await wait(30);
            element.style.opacity = "1";
            element.style.transform = "scale(1)";
        },
        animateFadeOut: async function (exitFunction) {
            element.style.transition = transition;
            await wait(10);
            element.style.opacity = "0";
            element.style.transform = "scale(0.8)";
            await wait(timeout + 10);
            exitFunction();
        }
    };
};