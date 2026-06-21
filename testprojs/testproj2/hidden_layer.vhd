
library IEEE;
use IEEE.STD_LOGIC_1164.ALL;

use IEEE.NUMERIC_STD.ALL;

entity hidden_layer is
    Port ( 
        clk : in std_logic;
        reset_n : in std_logic;
        clear_acc : in std_logic_vector(15 downto 0);
        
        --this is the pixel that is currently being sent to all nodes with address
        pixel_broadcast : in std_logic;
        pixel_addr : in unsigned(9 downto 0);
        calc_enable : in std_logic;
        
        --training/loading interface
        train_we : in std_logic;
        train_neuron_sel : in unsigned(8 downto 0);
        train_addr : in unsigned(9 downto 0);
        train_data_in : in std_logic_vector(7 downto 0);
        train_data_out : out std_logic_vector(7 downto 0);
        
        layer_output : out std_logic;
        layer_output_addr : in unsigned(8 downto 0)
        
    );
end hidden_layer;

architecture Behavioral of hidden_layer is
    -- 512 bits to collect all outputs from all 32 PEs
    signal layer_out_signal : std_logic_vector(255 downto 0);
    signal pe_data_out_bus : std_logic_vector(127 downto 0);
begin

    -- Instantiate 32 Processing Engines
    GEN_PES: for i in 0 to 15 generate
        signal pe_we : std_logic;
    begin
        -- TRAINING LOGIC: 
        -- train_neuron_sel is 9 bits (0-511).
        -- Bits 8 downto 4 identify which PE (0-31)
        -- Bits 3 downto 0 identify which Neuron inside that PE (0-15)
        pe_we <= '1' when (train_we = '1' and train_neuron_sel(8 downto 4) = to_unsigned(i, 5)) else '0';

        U_PE : entity work.processing_engine_HL
            port map (
                clk             => clk,
                reset_n         => reset_n,
                clear_acc       => clear_acc(i),
                
                pixel_in        => pixel_broadcast,
                pixel_addr      => pixel_addr,
                calc_enable     => calc_enable,
                
                -- Training Interface
                -- We pass the lower 4 bits to select the neuron inside the PE
                neuron_select   => train_neuron_sel(3 downto 0),
                weight_we       => pe_we,
                weight_addr_w   => train_addr,
                weight_data_8b  => train_data_in,
                weight_data_out_8b => pe_data_out_bus((i*8)+7 downto (i*8)),
                
                -- Output Mapping: Slice the 512-bit vector for this PE
                pe_activations_out => layer_out_signal((i*16)+15 downto (i*16))
            );
    end generate;

    layer_output <= layer_out_signal(to_integer(layer_output_addr));
    process(train_neuron_sel, pe_data_out_bus)
        variable pe_index : integer;
    begin
        pe_index := to_integer(train_neuron_sel(8 downto 4));
        
        if pe_index < 16 then
            train_data_out <= pe_data_out_bus((pe_index*8)+7 downto (pe_index*8));
        else
            train_data_out <= (others => '0');
        end if;
    end process;

end Behavioral;

