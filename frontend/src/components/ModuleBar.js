import React, { useState } from "react";
import { Strong, IconButton } from "@radix-ui/themes";
import { StarIcon, StarFilledIcon, CheckIcon } from "@radix-ui/react-icons";
import { useNavigate } from "react-router-dom";

export const ModuleBar = ({ module }) => {
	const [hover, setHover] = useState(false);

	const navigate = useNavigate();

	return (
		<div
			style={{
				width: "100%",
				height: "5vh",
				display: "flex",
				alignItems: "center",
				cursor: "pointer",
				transition: "background 0.15s ease",
				background: hover ? "rgba(255,255,255,0.05)" : "transparent",
				padding: "0 1rem",
				boxSizing: "border-box",
			}}
			onClick={() => navigate(`/modules/${module.id}`)}
			onMouseEnter={() => setHover(true)}
			onMouseLeave={() => setHover(false)}
		>
			<Strong>{module.name}</Strong>

			<div
				style={{
					display: "flex",
					alignItems: "center",
					marginLeft: "auto",
					gap: "0.5rem",
				}}
			>
				{module.verified && <CheckIcon height={20} width={20} />}

				<IconButton
					variant="ghost"
					onClick={(e) => {
						e.stopPropagation(); // so star button doesn't trigger navigation
					}}
				>
					{module.isFavorite
						? <StarFilledIcon height={20} width={20} />
						: <StarIcon height={20} width={20} />}
				</IconButton>
			</div>
		</div>
	);
};

export default ModuleBar;
