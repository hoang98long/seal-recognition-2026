from app.matching.base import MatchInput, MatchOutput


class SiameseMatcher:
    async def analyse(self, request: MatchInput) -> MatchOutput:
        raise NotImplementedError("V2: cần huấn luyện embedding và đánh giá trên bộ dữ liệu con dấu.")
