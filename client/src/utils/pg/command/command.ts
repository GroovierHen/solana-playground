import * as commands from "./commands";
import { PgCommon } from "../common";
import { PgTerminal } from "../terminal";
import type { Disposable } from "../types";

/** Terminal command */
export interface CommandImpl<R> {
  /** Name of the command that will be used in terminal */
  name: string;
  /** Description that will be seen in the `help` command */
  description: string;
  /** Function to run when the command is called */
  run: (input: string) => R;
  /* Only process the command if the condition passes */
  preCheck?: () => boolean;
}

/** All commands type */
type InternalCommands = typeof commands;

/** Name of all the available commands(only code) */
type CommandCodeName = keyof InternalCommands;

/** Ready to be used commands */
type Commands = {
  [N in keyof InternalCommands]: InternalCommands[N] extends CommandImpl<
    infer R
  >
    ? Command<R>
    : never;
};

/** Command type for external usage */
type Command<R> = Pick<CommandImpl<R>, "name"> & {
  /** Command processor */
  run(args?: string): Promise<Awaited<R>>;
  /**
   * @param cb callback function to run when the command starts running
   * @returns a dispose function to clear the event
   */
  onDidRunStart(cb: (input: string | null) => void): Disposable;
  /**
   * @param cb callback function to run when the command finishes running
   * @returns a dispose function to clear the event
   */
  onDidRunFinish(cb: (input: string | null) => void): Disposable;
};

/** Get custom event name for the given command. */
const getEventName = (name: string, kind: "start" | "finish") => {
  switch (kind) {
    case "start":
      return "ondidrunstart" + name;
    case "finish":
      return "ondidrunfinish" + name;
  }
};

/** Command manager */
export const PgCommand: Commands = new Proxy(
  {},
  {
    get: (target: any, name: CommandCodeName): Command<unknown> => {
      if (target[name]) return target[name];

      const commandName = commands[name].name;
      target[name] = {
        name: commandName,
        run: (args: string = "") => {
          return PgTerminal.executeFromStr(`${commandName} ${args}`);
        },
        onDidRunStart: (cb: (input: string | null) => void) => {
          return PgCommon.onDidChange({
            cb,
            eventName: getEventName(name, "start"),
            initialRun: { value: null },
          });
        },
        onDidRunFinish: (cb: (input: string | null) => void) => {
          return PgCommon.onDidChange({
            cb,
            eventName: getEventName(name, "finish"),
            initialRun: { value: null },
          });
        },
      };

      return target[name];
    },
  }
);

/**
 * Command executor.
 *
 * This is intended for internal usage. Running commands should be done with
 * `PgCommand` instead.
 */
export class PgCommandExecutor {
  /**
   * Execute from the given input.
   *
   * All command processing logic happens in this method.
   *
   * @param input full user input starting with the command name
   * @returns the return value of the command
   */
  static async execute(input: string) {
    return await PgTerminal.process(async () => {
      // This guarantees commands only start with the specified command name.
      // `solana-keygen` would not count for inputCmdName === "solana"
      const inputCmdName = input.trim().split(" ")?.at(0);
      if (!inputCmdName) return;

      for (const cmdName in commands) {
        const cmd = commands[cmdName as CommandCodeName];
        if (inputCmdName !== cmd.name) continue;
        if (cmd.preCheck && !cmd.preCheck()) return;

        // Dispatch start event
        PgCommon.createAndDispatchCustomEvent(
          getEventName(cmdName, "start"),
          input
        );

        // Run the command processor
        const result = await cmd.run(input);

        // Dispatch finish event
        PgCommon.createAndDispatchCustomEvent(
          getEventName(cmdName, "finish"),
          input
        );

        return result;
      }

      PgTerminal.log(`Command '${PgTerminal.italic(input)}' not found.`);
    });
  }
}