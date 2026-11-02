from app.matching.base import MatchInput, MatchOutput


class EnsembleMatcher:
    async def analyse(self, request: MatchInput) -> MatchOutput:
        raise NotImplementedError(
            "V3: Random Forest/LightGBM, hiệu chuẩn và SHAP cần tập dữ liệu đã thẩm định."
        )
