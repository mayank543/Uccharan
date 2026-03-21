const MAX_TWEET_LENGTH = 280

export const getTweetLength = (text: string) => text.trim().length

export const isTweetTooLong = (text: string) => getTweetLength(text) > MAX_TWEET_LENGTH

export const buildTwitterIntentUrl = (text: string) => {
  const params = new URLSearchParams({
    text: text.trim()
  })

  return `https://twitter.com/intent/tweet?${params.toString()}`
}

export { MAX_TWEET_LENGTH }
