module energy_estimator #(
    parameter WIDTH = 16,
    parameter ACC_W = 40
)(
    input  wire                 clk,
    input  wire                 rst_n,
    input  wire                 sample_valid,
    input  wire                 window_reset,
    input  wire signed [WIDTH-1:0] sample_in,
    output wire signed [ACC_W-1:0] energy_out,
    output wire                 ovf_err
);

    // NEW: Input pipeline register to improve DSP block routing timing
    reg signed [WIDTH-1:0] sample_pipe;
    reg                    valid_pipe;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            sample_pipe <= {WIDTH{1'b0}};
            valid_pipe  <= 1'b0;
        end else begin
            sample_pipe <= sample_in;
            valid_pipe  <= sample_valid;
        end
    end

    // MODIFIED: Uses pipelined signals and wires the .en() port
    dsp_mac_core #(
        .DATA_WIDTH(WIDTH),
        .ACC_WIDTH(ACC_W)
    ) u_mac_sqr (
        .clk      (clk),
        .rst_n    (rst_n),
        .en       (valid_pipe),     // NEW: Wired enable from pipeline
        .clr_acc  (window_reset),
        .mult_a   (sample_pipe),
        .mult_b   (sample_pipe),
        .acc_out  (energy_out),
        .overflow (ovf_err)
    );

endmodule
