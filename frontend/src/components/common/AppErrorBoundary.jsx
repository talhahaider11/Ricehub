import { Component } from "react";

export default class AppErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("The app page failed to render:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="app-render-error" role="alert">
          <h1>This page could not be displayed</h1>
          <p>Something went wrong while loading this page. Please try again.</p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload page
          </button>
          <a href="/login">Return to login</a>
        </main>
      );
    }

    return this.props.children;
  }
}
