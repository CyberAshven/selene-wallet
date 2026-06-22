import FullColumn from "@/layout/FullColumn";

function BlissTicketsView() {
  return (
    <FullColumn>
      <div className="px-2 py-4">
        <h1 className="font-bliss text-2xl text-[#e8078c] bg-[linear-gradient(to_bottom,_rgb(232,_7,_140),_rgb(160,_137,_191))] bg-clip-text text-transparent">
          Tickets
        </h1>
        <div>
          <p1>Entry to BLISS 2026 requires a Layla NFT.</p1>
        </div>
        <div>
          <p1>Your tickets</p1>
        </div>
        <div>
          <p1>Available tickets</p1>
        </div>
      </div>
    </FullColumn>
  );
}

export default BlissTicketsView;
