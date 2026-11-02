from typing import Any, Protocol

from PIL import Image


class StampDetectorProvider(Protocol):
    def detect(self, image: Image.Image) -> list[dict[str, Any]]: ...


class StampSegmenterProvider(Protocol):
    def segment(self, image: Image.Image) -> Any: ...


class StampRegistrationProvider(Protocol):
    def register(self, query: Any, reference: Any) -> Any: ...


class FeatureExtractorProvider(Protocol):
    def extract(self, registered_pair: Any) -> dict[str, float]: ...


class RetrieverProvider(Protocol):
    def retrieve(self, query: Image.Image, top_k: int) -> list[str]: ...


class PairClassifierProvider(Protocol):
    def classify(self, features: dict[str, float]) -> dict[str, Any]: ...


class ScoreCalibrationProvider(Protocol):
    def calibrate(self, raw_score: float) -> dict[str, Any]: ...


class ReportProvider(Protocol):
    def render(self, analysis: dict[str, Any]) -> bytes: ...
