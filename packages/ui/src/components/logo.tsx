import Collaborate from "@carbon/icons-react/es/Collaborate";
import type * as React from "react";

function Logo({
	"aria-label": ariaLabel = "CRM Corporativo",
	"aria-hidden": ariaHidden,
	...props
}: React.SVGProps<SVGSVGElement>) {
	const decorative = ariaHidden === true || ariaHidden === "true";

	return (
		<Collaborate
			width={512}
			height={512}
			focusable={false}
			role={decorative ? undefined : "img"}
			aria-label={decorative ? undefined : ariaLabel}
			aria-hidden={ariaHidden}
			{...props}
		/>
	);
}

export default Logo;
