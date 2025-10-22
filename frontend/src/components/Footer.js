import { Text, Separator } from "@radix-ui/themes";

export default function Footer() {
	return (
		<footer
			style={{
				width: "100%",
				display: "flex",
				justifyContent: "center",
				alignItems: "center",
				height: "5vh",
				backgroundColor: "transparent",
				color: "#ededed",
			}}
		>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: "1rem",
					flexWrap: "wrap",
				}}
			>
				<FooterLink label="Home" href="#" />
				<Separator orientation="vertical" />

				<FooterLink label="About" href="#" />
				<Separator orientation="vertical" />
				<FooterLink label="Documentation" href="#" />
				<Separator orientation="vertical" />
				<FooterLink label="Source" href="#" />
				<Separator orientation="vertical" />
				<FooterLink label="Privacy Policy" href="#" />
				<Separator orientation="vertical" />
				<FooterLink label="Terms of Service" href="#" />
			</div>
		</footer>
	);
}

function FooterLink({ label, href }) {
	return (
		<a
			href={href}
			style={{
				textDecoration: "none",
				color: "#ededed",
				transition: "color 0.2s ease",
			}}
			onMouseEnter={(e) => (e.target.style.color = "#aaa")}
			onMouseLeave={(e) => (e.target.style.color = "#ededed")}
		>
			<Text size="3">{label}</Text>
		</a>
	);
}
