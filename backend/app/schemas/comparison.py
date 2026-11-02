from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class EvidenceItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    category: Literal[
        "outer_ring", "inner_ring", "text", "symbol", "layout", "color", "local_detail", "other"
    ]
    description: str = Field(max_length=3000)
    strength: Literal["weak", "moderate", "strong", "uncertain"]
    region_description: str = Field(max_length=2000)


class SealVisualComparison(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal["success", "insufficient_data"]
    verdict: Literal["visually_similar", "partially_similar", "visually_different", "insufficient_evidence"]
    visual_similarity_score: float | None = Field(ge=0, le=100)
    visual_confidence_label: Literal["low", "medium", "high"]
    same_design_plausible: bool | None
    summary_vi: str = Field(max_length=6000)
    observations_q: list[str]
    observations_k: list[str]
    matching_features: list[EvidenceItem]
    differing_features: list[EvidenceItem]
    uncertain_features: list[EvidenceItem]
    text_recognition_q: list[str]
    text_recognition_k: list[str]
    limitations: list[str]
    recommendation_vi: str = Field(max_length=6000)

    @model_validator(mode="after")
    def semantic_policy(self):
        if self.status == "insufficient_data" or self.verdict == "insufficient_evidence":
            self.status = "insufficient_data"
            self.verdict = "insufficient_evidence"
            self.visual_similarity_score = None
            self.same_design_plausible = None
        return self
