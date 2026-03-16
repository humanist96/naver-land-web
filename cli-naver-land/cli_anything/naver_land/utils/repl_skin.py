"""cli-anything REPL Skin — Customized for Naver Land CLI.

Copied from cli-anything-plugin/repl_skin.py with naver_land accent color.
"""

from __future__ import annotations

import os
import sys
import re

# ANSI color codes
_RESET = "\033[0m"
_BOLD = "\033[1m"
_DIM = "\033[2m"

_CYAN = "\033[38;5;80m"
_WHITE = "\033[97m"
_GRAY = "\033[38;5;245m"
_DARK_GRAY = "\033[38;5;240m"
_LIGHT_GRAY = "\033[38;5;250m"

_GREEN = "\033[38;5;78m"
_YELLOW = "\033[38;5;220m"
_RED = "\033[38;5;196m"
_BLUE = "\033[38;5;75m"

# Naver Land accent: warm green (Naver brand-ish)
_ACCENT = "\033[38;5;41m"
_ACCENT_HEX = "#00d75f"

_V_LINE = "\u2502"
_H_LINE = "\u2500"
_TL = "\u256d"
_TR = "\u256e"
_BL = "\u2570"
_BR = "\u256f"

_ICON_SMALL = f"{_CYAN}\u25b8{_RESET}"


def _strip_ansi(text: str) -> str:
    return re.sub(r"\033\[[^m]*m", "", text)


def _visible_len(text: str) -> int:
    return len(_strip_ansi(text))


class ReplSkin:
    def __init__(self, software: str = "naver_land", version: str = "1.0.0",
                 history_file: str | None = None):
        self.software = software
        self.display_name = "Naver Land"
        self.version = version
        self.accent = _ACCENT

        if history_file is None:
            from pathlib import Path
            hist_dir = Path.home() / ".cli-anything-naver-land"
            hist_dir.mkdir(parents=True, exist_ok=True)
            self.history_file = str(hist_dir / "history")
        else:
            self.history_file = history_file

        self._color = self._detect_color_support()

    def _detect_color_support(self) -> bool:
        if os.environ.get("NO_COLOR"):
            return False
        if not hasattr(sys.stdout, "isatty"):
            return False
        return sys.stdout.isatty()

    def _c(self, code: str, text: str) -> str:
        if not self._color:
            return text
        return f"{code}{text}{_RESET}"

    def print_banner(self):
        inner = 54

        def _box_line(content: str) -> str:
            pad = inner - _visible_len(content)
            vl = self._c(_DARK_GRAY, _V_LINE)
            return f"{vl}{content}{' ' * max(0, pad)}{vl}"

        top = self._c(_DARK_GRAY, f"{_TL}{_H_LINE * inner}{_TR}")
        bot = self._c(_DARK_GRAY, f"{_BL}{_H_LINE * inner}{_BR}")

        icon = self._c(_CYAN + _BOLD, "\u25c6")
        brand = self._c(_CYAN + _BOLD, "cli-anything")
        dot = self._c(_DARK_GRAY, "\u00b7")
        name = self._c(self.accent + _BOLD, self.display_name)
        title = f" {icon}  {brand} {dot} {name}"

        ver = f" {self._c(_DARK_GRAY, f'   v{self.version}')}"
        tip = f" {self._c(_DARK_GRAY, '   Type help for commands, quit to exit')}"

        print(top)
        print(_box_line(title))
        print(_box_line(ver))
        print(_box_line(""))
        print(_box_line(tip))
        print(bot)
        print()

    def prompt_tokens(self, project_name: str = "", modified: bool = False,
                      context: str = ""):
        tokens = []
        tokens.append(("class:icon", "\u25c6 "))
        tokens.append(("class:software", self.software))
        if project_name or context:
            ctx = context or project_name
            mod = "*" if modified else ""
            tokens.append(("class:bracket", " ["))
            tokens.append(("class:context", f"{ctx}{mod}"))
            tokens.append(("class:bracket", "]"))
        tokens.append(("class:arrow", " \u276f "))
        return tokens

    def get_prompt_style(self):
        try:
            from prompt_toolkit.styles import Style
        except ImportError:
            return None
        return Style.from_dict({
            "icon": "#5fdfdf bold",
            "software": f"{_ACCENT_HEX} bold",
            "bracket": "#585858",
            "context": "#bcbcbc",
            "arrow": "#808080",
            "completion-menu.completion": "bg:#303030 #bcbcbc",
            "completion-menu.completion.current": f"bg:{_ACCENT_HEX} #000000",
            "auto-suggest": "#585858",
            "bottom-toolbar": "bg:#1c1c1c #808080",
        })

    def create_prompt_session(self):
        try:
            from prompt_toolkit import PromptSession
            from prompt_toolkit.history import FileHistory
            from prompt_toolkit.auto_suggest import AutoSuggestFromHistory

            return PromptSession(
                history=FileHistory(self.history_file),
                auto_suggest=AutoSuggestFromHistory(),
                style=self.get_prompt_style(),
                enable_history_search=True,
            )
        except ImportError:
            return None

    def get_input(self, pt_session, project_name: str = "",
                  modified: bool = False, context: str = "") -> str:
        if pt_session is not None:
            from prompt_toolkit.formatted_text import FormattedText
            tokens = self.prompt_tokens(project_name, modified, context)
            return pt_session.prompt(FormattedText(tokens)).strip()
        else:
            return input(f"\u25c6 {self.software} \u276f ").strip()

    def success(self, message: str):
        icon = self._c(_GREEN + _BOLD, "\u2713")
        print(f"  {icon} {self._c(_GREEN, message)}")

    def error(self, message: str):
        icon = self._c(_RED + _BOLD, "\u2717")
        print(f"  {icon} {self._c(_RED, message)}", file=sys.stderr)

    def warning(self, message: str):
        icon = self._c(_YELLOW + _BOLD, "\u26a0")
        print(f"  {icon} {self._c(_YELLOW, message)}")

    def info(self, message: str):
        icon = self._c(_BLUE, "\u25cf")
        print(f"  {icon} {self._c(_LIGHT_GRAY, message)}")

    def section(self, title: str):
        print()
        print(f"  {self._c(self.accent + _BOLD, title)}")
        print(f"  {self._c(_DARK_GRAY, _H_LINE * len(title))}")

    def table(self, headers: list[str], rows: list[list[str]],
              max_col_width: int = 40):
        if not headers:
            return

        col_widths = [min(len(h), max_col_width) for h in headers]
        for row in rows:
            for i, cell in enumerate(row):
                if i < len(col_widths):
                    col_widths[i] = min(
                        max(col_widths[i], len(str(cell))), max_col_width
                    )

        def pad(text: str, width: int) -> str:
            t = str(text)[:width]
            return t + " " * (width - len(t))

        header_cells = [
            self._c(_CYAN + _BOLD, pad(h, col_widths[i]))
            for i, h in enumerate(headers)
        ]
        sep = self._c(_DARK_GRAY, f" {_V_LINE} ")
        print(f"  {sep.join(header_cells)}")

        sep_line = self._c(_DARK_GRAY, f"  {'───'.join([_H_LINE * w for w in col_widths])}")
        print(sep_line)

        for row in rows:
            cells = []
            for i, cell in enumerate(row):
                if i < len(col_widths):
                    cells.append(self._c(_LIGHT_GRAY, pad(str(cell), col_widths[i])))
            row_sep = self._c(_DARK_GRAY, f" {_V_LINE} ")
            print(f"  {row_sep.join(cells)}")

    def help(self, commands: dict[str, str]):
        self.section("Commands")
        max_cmd = max(len(c) for c in commands) if commands else 0
        for cmd, desc in commands.items():
            cmd_styled = self._c(self.accent, f"  {cmd:<{max_cmd}}")
            desc_styled = self._c(_GRAY, f"  {desc}")
            print(f"{cmd_styled}{desc_styled}")
        print()

    def print_goodbye(self):
        print(f"\n  {_ICON_SMALL} {self._c(_GRAY, 'Goodbye!')}\n")
