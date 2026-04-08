import Editor from "@monaco-editor/react"

export default function EditorPanel() {
  return (
    <Editor
      height="90vh"
      defaultLanguage="javascript"
      defaultValue="// start coding"
      theme="vs-dark" // Options: "light", "vs-dark"
      options={{
        fontSize: 14,
        minimap: { enabled: true },
        contextmenu: true,
      }}
    />
  )
}
