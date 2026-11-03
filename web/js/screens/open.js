// Open a game from the list: sequences in the sequence editor, others in the exercise editor.
import { nav } from "../app.js";
import { store } from "../store.js";
import { editorScreen } from "./editor.js";
import { sequenceScreen } from "./sequence.js";

export function openGame(uuid){
  const g = uuid ? store.get(uuid) : null;
  if (g?.sequence) nav.push(sequenceScreen(uuid), 0);
  else nav.push(editorScreen({uuid}), 0);
}
