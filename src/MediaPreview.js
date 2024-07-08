import { memo, useEffect, useState, useMemo, useCallback } from "react";
import { useSwipeable } from "react-swipeable";
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ArrowCircleLeftRoundedIcon from '@mui/icons-material/ArrowCircleLeftRounded';
import ArrowCircleRightRoundedIcon from '@mui/icons-material/ArrowCircleRightRounded';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import CircularProgress from '@mui/material/CircularProgress';
import "./MediaPreview.css";

export default memo(function MediaPreview({ imageSRC, mediaPreview, close, setRatio, activeElement, setActiveElement, isMedia, files }) {
	const [height, setHeight] = useState("");
	const [swipeIsActive, setSwipeIsActive] = useState(false);

	useEffect(() => {
		setHeight(document.querySelector('.chat').offsetHeight);
		document.querySelectorAll(".carousel__img").forEach((img, index) => {
			img.onload = () => {
				URL.revokeObjectURL(img.src);
				setRatio(prevRatios => {
					const newRatios = [...prevRatios];
					newRatios[index] = img.naturalHeight / img.naturalWidth;
					console.log("new ratios: ", newRatios);
					return newRatios;
				});
			};
		});
	}, [imageSRC]);

	useEffect(() => {
		setActiveElement(isMedia === "images" ? 0 : imageSRC.length - 1);
	}, [imageSRC, isMedia])

	const elementPercentage = useMemo(() => 100 / imageSRC.length, [imageSRC]);

	const next = useCallback(() => {
		if (!swipeIsActive) {
			setSwipeIsActive(true);
			setActiveElement(previousActive => {
				if (previousActive === imageSRC.length - 1) {
					return 0;
				};
				return previousActive + 1;
			});
			setTimeout(() => {
				setSwipeIsActive(false);
			}, [260]);
		};

	}, [imageSRC, swipeIsActive]);

	const back = useCallback(() => {
		if (!swipeIsActive) {
			setSwipeIsActive(true);
			setActiveElement(previousActive => {
				if (previousActive === 0) {
					return imageSRC.length - 1;
				};
				return previousActive - 1;
			});
			setTimeout(() => {
				setSwipeIsActive(false);
			}, [260])
		};
	}, [imageSRC, swipeIsActive]);

	const swipeHandler = useSwipeable({
		onSwipedLeft: next,
		onSwipedRight: back
	});

	const closeWithoutMessage = useCallback(() => close(false), []);

	return (
		<div
			ref={mediaPreview}
			className="mediaPreview"
			style={{
				height: height,
			}}
		>
			{isMedia === "loading" ?
				<CircularProgress size={80} />
			:
				<>
					<CloseRoundedIcon onClick={closeWithoutMessage} className="close__arrow" />
					{imageSRC.length > 1 && <ArrowCircleLeftRoundedIcon onClick={back} className="left__arrow arrow" />}
					<div className="carousel" {...swipeHandler}>
						<div className="inner"
							style={{
								width: 100 * imageSRC.length + "%",
								transform: `translateX(-${activeElement * elementPercentage}%)`
							}}
						>
							{isMedia === "images" || isMedia === "images_dropped" ?
								imageSRC.map((image, index) => (
									<div className="carousel__item" key={image + index}>
										<img draggable={false} className="carousel__img" src={image} alt="" />
									</div>
								))
							:
								imageSRC.map((image, index) => (
									<div className="carousel__item" key={image + index}>
										<div className="media__details">
											<InsertDriveFileIcon />
											<h3>{files[index].name}</h3>
										</div>
										<img draggable={false} className="carousel__img" src={image} alt="" />
									</div>
								))
							}
						</div>
					</div>
					{imageSRC.length > 1 && <ArrowCircleRightRoundedIcon onClick={next} className="right__arrow arrow" />}
				</>
			}
		</div>
	)
});