import chalk from "chalk";

const time = () => new Date().toLocaleTimeString("en-PK", { timeZone: "Asia/Karachi", hour12: false });

export const logger = {
  info:    (msg) => console.log(`${chalk.gray(time())} ${chalk.cyan("INFO")}  ${msg}`),
  success: (msg) => console.log(`${chalk.gray(time())} ${chalk.green("OK")}    ${msg}`),
  warn:    (msg) => console.log(`${chalk.gray(time())} ${chalk.yellow("WARN")}  ${msg}`),
  error:   (msg) => console.log(`${chalk.gray(time())} ${chalk.red("ERROR")} ${msg}`),
  event:   (msg) => console.log(`${chalk.gray(time())} ${chalk.magenta("EVENT")} ${msg}`),
  cmd:     (msg) => console.log(`${chalk.gray(time())} ${chalk.blue("CMD")}   ${msg}`),
};
