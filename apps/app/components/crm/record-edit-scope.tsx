"use client";

import { Alert, AlertDescription, AlertTitle } from "@crm/ui/components/alert";
import { createContext, type ReactNode, useContext } from "react";

const RecordReadOnly = createContext(false);

export function RecordEditScope({
	readOnly,
	children,
}: {
	readOnly: boolean;
	children: ReactNode;
}) {
	const inherited = useRecordReadOnly();
	return (
		<RecordReadOnly value={readOnly || inherited}>{children}</RecordReadOnly>
	);
}

export function useRecordReadOnly() {
	return useContext(RecordReadOnly);
}

export function RecordReadOnlyNotice({
	archived,
	loading,
	error,
}: {
	archived: boolean;
	loading: boolean;
	error: boolean;
}) {
	return (
		<Alert variant={error ? "destructive" : "default"}>
			<AlertTitle>
				{loading ? "Comprobando permisos" : "Ficha de sólo lectura"}
			</AlertTitle>
			<AlertDescription>
				{error
					? "No se pueden comprobar tus permisos. Recarga la página antes de editar."
					: loading
						? "Espera a que se carguen tu sesión y rol."
						: archived
							? "Restaura el registro antes de editarlo. El borrado definitivo requiere al propietario."
							: "El responsable o administración pueden editar. Los demás miembros pueden consultar la ficha."}
			</AlertDescription>
		</Alert>
	);
}
