import * as React from "react";
import * as ReactDOM from "react-dom";

const style = require("./main.module.scss");

function Main() {
  return <div className={style.hello}>Hello world!</div>;
}

ReactDOM.render(<Main />, document.getElementById("root"));
