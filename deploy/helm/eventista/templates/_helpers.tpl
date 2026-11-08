{{- define "eventista.labels" -}}
app.kubernetes.io/part-of: eventista
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end }}
