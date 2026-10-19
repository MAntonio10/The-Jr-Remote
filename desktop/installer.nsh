; Registra el servicio SYSTEM que deja controlar el UAC y la pantalla de bloqueo (ver desktop/helper).
; El instalador corre elevado (perMachine) para poder crear el servicio.
!macro customInstall
  nsExec::Exec '$SYSDIR\sc.exe stop TheJrHelper'
  nsExec::Exec '$SYSDIR\sc.exe delete TheJrHelper'
  nsExec::Exec '$SYSDIR\sc.exe create TheJrHelper binPath= "\"$INSTDIR\resources\app.asar.unpacked\helper\out\TheJrHelper.exe\" service \"$INSTDIR\The Jr.exe\"" start= auto obj= LocalSystem DisplayName= "The Jr Helper"'
  nsExec::Exec '$SYSDIR\sc.exe start TheJrHelper'
!macroend

!macro customUnInstall
  nsExec::Exec '$SYSDIR\sc.exe stop TheJrHelper'
  nsExec::Exec '$SYSDIR\sc.exe delete TheJrHelper'
!macroend
