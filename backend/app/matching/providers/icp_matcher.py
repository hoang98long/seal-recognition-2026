from app.matching.base import MatchInput, MatchOutput


class ICPMatcher:
    async def analyse(self, request: MatchInput) -> MatchOutput:
        raise NotImplementedError("V2: đăng ký hình học ICP đa khởi tạo cần dữ liệu kiểm chứng.")
