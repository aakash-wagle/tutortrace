import '../index.css'

export const metadata = {
  title: 'StudyHub – Course Planner',
  description: 'AI-powered personalized course planning for StudyHub',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div id="root">
          {children}
        </div>
      </body>
    </html>
  )
}
