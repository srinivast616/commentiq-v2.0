import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-graphite-900">
      <div className="mx-auto max-w-5xl px-6 py-24">
        <div className="signal-ribbon w-24 mb-8" />
        <h1 className="text-5xl font-semibold tracking-tight text-graphite-200 leading-tight">
          Your audience is talking.
          <br />
          <span className="text-signal-positive">CommentIQ</span> decodes what they're saying.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-graphite-400">
          Paste a YouTube video URL or upload a comment export. Get sentiment,
          emotion, topics, and an executive summary in under a minute —
          instead of reading a thousand comments yourself.
        </p>

        <div className="mt-10 flex gap-4">
          <Link
            href="/login"
            className="rounded-lg bg-signal-positive px-6 py-3 font-medium text-graphite-950 hover:opacity-90 transition"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-graphite-600 px-6 py-3 font-medium text-graphite-200 hover:bg-graphite-800 transition"
          >
            Sign in
          </Link>
        </div>

        <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <FeatureCard
            accent="positive"
            title="Sentiment & emotion"
            body="Every comment scored positive, neutral, or negative — plus joy, anger, sarcasm, and more."
          />
          <FeatureCard
            accent="neutral"
            title="AI topic clustering"
            body="Comments group themselves into topics like Pricing or Feature Requests, named by AI, no taxonomy to maintain."
          />
          <FeatureCard
            accent="negative"
            title="Chat with your comments"
            body='Ask "what do people dislike most?" and get an answer grounded in the actual comments.'
          />
        </div>
      </div>
    </main>
  );
}

function FeatureCard({ accent, title, body }: { accent: "positive" | "neutral" | "negative"; title: string; body: string }) {
  const colorClass =
    accent === "positive" ? "text-signal-positive" : accent === "neutral" ? "text-signal-neutral" : "text-signal-negative";
  return (
    <div className="card p-6">
      <div className={`text-sm font-mono ${colorClass}`}>●</div>
      <h3 className="mt-3 font-semibold text-graphite-200">{title}</h3>
      <p className="mt-2 text-sm text-graphite-400">{body}</p>
    </div>
  );
}
