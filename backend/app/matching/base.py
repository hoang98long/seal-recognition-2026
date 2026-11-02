from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from app.schemas.comparison import SealVisualComparison


@dataclass(frozen=True)
class MatchInput:
    query_path: Path
    reference_path: Path
    context: dict | None = None


@dataclass(frozen=True)
class MatchOutput:
    comparison: SealVisualComparison
    model: str
    request_id: str | None
    usage: dict | None


class MatchingProvider(Protocol):
    async def analyse(self, request: MatchInput) -> MatchOutput: ...
