import { Alert, AlertDescription, AlertTitle } from "@crm/ui/components/alert";

export function AiDisabledNotice() {
	return (
		<Alert>
			<AlertTitle>IA desactivada en esta instalación</AlertTitle>
			<AlertDescription>
				El CRM manual funciona sin IA. Los agentes no reciben mensajes ni
				investigan registros. El historial permanece disponible. El
				administrador controla la activación.
			</AlertDescription>
		</Alert>
	);
}
