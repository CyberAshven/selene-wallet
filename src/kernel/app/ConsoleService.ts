import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { stringify } from "@bitauth/libauth";
import Logger from "js-logger";
import { DateTime } from "luxon";

let lines: Array<{ level: number; message: string }> = [];
const timers = {};
const denyLoggers = ["WalletManager", "KeyManager"];

function ConsoleService() {
  return {
    registerLine,
    getLines,
    clearLines,
    exportLogs,
  };

  function registerLine(messages, context) {
    const message: Array<string> = [];

    //console.log(context);

    if (context.name) {
      message.push(`[${context.name}]`);

      // exclude some lines from exported log (i.e. ones that contain secrets)
      if (denyLoggers.includes(context.name)) {
        return;
      }
    }

    switch (context.level) {
      case Logger.TIME:
        if (messages[1] === "start") {
          timers[messages[0]] = Date.now();
          message.push(messages[0]);
        }

        if (messages[1] === "end") {
          message.push(messages[0]);
          message.push(`${Date.now() - timers[messages[0]]}msec`);
        }

        break;

      default:
        message.push(
          Object.values(messages)
            .map((val) => stringify(val))
            .join(" ")
        );
        break;
    }

    message.unshift(DateTime.now().toFormat("HH:mm:ss.SSS"));
    lines.push({ level: context.level, message: message.join(" ") });
  }

  function getLines() {
    return lines;
  }

  function clearLines() {
    lines = [];
  }

  async function exportLogs() {
    const filename = `selene/selene.log.${Date.now()}.txt`;
    const data = lines.map((l) => l.message).join("\n~ ");

    await Filesystem.writeFile({
      path: filename,
      data,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true,
    });

    const { uri } = await Filesystem.writeFile({
      path: filename,
      data,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
      recursive: true,
    });

    await Share.share({
      dialogTitle: "Export Selene Logs",
      url: uri,
    });
  }
}

export default ConsoleService;
