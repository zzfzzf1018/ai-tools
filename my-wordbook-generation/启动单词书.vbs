Option Explicit

' Wordbook launcher: start a hidden local server, then open an Edge app window.
' Falls back to opening index.html directly when Node.js is unavailable.

Dim fso, shell, base, indexFile, edge, candidates, item, up

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
base = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = base
indexFile = base & "\index.html"

Function ServerUp()
  Dim http
  ServerUp = False
  On Error Resume Next
  Set http = CreateObject("MSXML2.XMLHTTP.6.0")
  If Err.Number <> 0 Then
    Err.Clear
    Set http = CreateObject("MSXML2.XMLHTTP")
  End If
  If Err.Number <> 0 Then
    Err.Clear
    On Error GoTo 0
    Exit Function
  End If
  http.Open "GET", "http://127.0.0.1:4173/", False
  http.Send
  If Err.Number = 0 Then
    If http.Status = 200 Then ServerUp = True
  End If
  Err.Clear
  On Error GoTo 0
End Function

up = ServerUp()
If Not up Then
  On Error Resume Next
  shell.Run "node ""scripts\serve.mjs""", 0, False
  If Err.Number <> 0 Then Err.Clear
  On Error GoTo 0
  WScript.Sleep 1600
  up = ServerUp()
End If

candidates = Array( _
  shell.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Microsoft\Edge\Application\msedge.exe", _
  shell.ExpandEnvironmentStrings("%ProgramFiles%") & "\Microsoft\Edge\Application\msedge.exe", _
  shell.ExpandEnvironmentStrings("%LocalAppData%") & "\Microsoft\Edge\Application\msedge.exe")

edge = ""
For Each item In candidates
  If fso.FileExists(item) Then
    edge = item
    Exit For
  End If
Next

If up Then
  If edge <> "" Then
    shell.Run """" & edge & """ --app=http://127.0.0.1:4173/ --window-size=1180,840", 1, False
  Else
    shell.Run "http://127.0.0.1:4173/", 1, False
  End If
Else
  shell.Run """" & indexFile & """", 1, False
End If
