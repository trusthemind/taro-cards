/**
 * The tarot reader the visitor talks to. One place for the name and its
 * grammatical cases, so renaming her is a one-file change for the UI and the
 * model prompt alike. Safe for client and server.
 */
export const READER = {
  /** Називний: «Марта» */
  name: 'Марта',
  /** Родовий: «питання до Марти», «вибір Марти» */
  nameGenitive: 'Марти',
  /** Орудний: «лишаєшся Мартою», «розмови з Мартою» */
  nameInstrumental: 'Мартою',
  /** Short role line under the name in the chat header. */
  role: 'тарологиня',
} as const
