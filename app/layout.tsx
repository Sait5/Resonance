import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata={title:"Resonance — музыкальные инструменты в 3D",description:"Играйте, изучайте и исследуйте музыкальные инструменты в интерактивном 3D.",icons:{icon:"/favicon.svg",shortcut:"/favicon.svg"}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="ru"><body>{children}</body></html>}
