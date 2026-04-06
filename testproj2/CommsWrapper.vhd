library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.numeric_std.ALL;

entity CommsWrapper is
Port ( 
    clk         : in  std_logic;
    reset_n     : in  std_logic;
    sclk        : in  std_logic;
    mosi        : in  std_logic;
    ss_n        : in  std_logic;
    miso        : out std_logic;
    
    -- BRAM Interface
    bram_addr   : out unsigned(9 downto 0);
    bram_data   : out std_logic;
    bram_we     : out std_logic;
    
    -- NN Control Signals
    image_ready : out std_logic;
    is_training : out std_logic;                    -- High if Mode=Train
    target_label: out std_logic_vector(7 downto 0);  -- The ground truth
    
    bnn_done : in std_logic;
    bnn_prediction : in std_logic_vector(3 downto 0);
    
    
    -- NN weight setting
    weight_we     : out std_logic;
    weight_neuron : out unsigned(9 downto 0); -- Increased to 10 bits to cover 0-521
    weight_addr   : out unsigned(9 downto 0);
    weight_data   : out std_logic_vector(7 downto 0);
    
    weight_data_in : in std_logic_vector(7 downto 0);
    weight_addr_in : out unsigned (9 downto 0);
    neuron_select_in : out unsigned(9 downto 0);
    
    weight_dump : out std_logic
);
end CommsWrapper;

architecture Behavioral of CommsWrapper is
    -- Internal Signals from SPI Physical
    signal byte_data_o  : std_logic_vector(7 downto 0);
    signal byte_ready_o : std_logic;
    signal tx_data_i    : std_logic_vector(7 downto 0) := (others => '0');
    
    -- FSM States
    type state_type is (WAIT_FOR_MODE, GET_PIXELS, GET_LABEL, LOAD_WEIGHTS, WAITING_BNN, FINISH_BNN, DONE, SEND_WEIGHTS, WAIT_PHASE, SEND_STATUS, SEND_STATUS_WAIT, NEXT_WEIGHT_RDY, WEIGHT_DELAY, WEIGHT_DELAY2);
    signal current_state : state_type := WAIT_FOR_MODE;
    
    type weight_state_type is (WAITING_NB_ONE, WAITING_NB_TWO, WAITING_AB_ONE, WAITING_AB_TWO, WAITING_DATA_BYTE);
    signal current_weight_state : weight_state_type := WAITING_NB_ONE;
    
    signal neuron_select_buffer : unsigned(9 downto 0) := (others => '0');
    signal addr_select_buffer : unsigned(9 downto 0) := (others => '0');
    
    signal pixel_count : unsigned(9 downto 0) := (others => '0');
    
    signal is_training_sig : std_logic;
    
    signal ss_n_sync : std_logic;
    signal ss_n_pipe : std_logic;
    
    signal tx_load : std_logic;
    
    signal weight_addr_r : unsigned (9 downto 0) := (others => '0');
    signal neuron_select_r : unsigned (9 downto 0) := (others => '0');
    
begin

    -- Instantiate Physical SPI (Keep your existing map)
    Physical_SPI: entity work.spi
        port map(
            clk => clk, reset_n => reset_n,
            sclk => sclk, mosi => mosi, ss_n => ss_n, miso => miso,
            byte_data_o => byte_data_o, byte_ready_o => byte_ready_o,
            tx_data_i => tx_data_i, tx_load_en => tx_load
        );
        
    is_training <= is_training_sig;
    
    

    process(clk)
    begin
        if rising_edge(clk) then
        
            ss_n_pipe <= ss_n;
            ss_n_sync <= ss_n_pipe;
        
            if reset_n = '0' or ss_n_sync = '1' then
                current_state <= WAIT_FOR_MODE;
                pixel_count   <= (others => '0');
                bram_we       <= '0';
                image_ready   <= '0';
                is_training_sig   <= '0';
                current_weight_state <= WAITING_NB_ONE;
                tx_data_i <= (others => '0');
            else
                bram_we     <= '0';
                weight_we <= '0';
                
                -- Main State Machine
                case current_state is
                    
                    when WAIT_FOR_MODE =>
                        tx_load <= '0';
                        weight_addr_r <= (others => '0');
                        neuron_select_r <= (others => '0');
                        weight_dump <= '0';
                        
                        if byte_ready_o = '1' then
                            if byte_data_o = x"04" then
                                current_state <= WEIGHT_DELAY;
                                weight_dump <= '1';
                            elsif byte_data_o = x"03" then      -- Mode 2: Load Weights
                                current_state <= LOAD_WEIGHTS;
                                current_weight_state <= WAITING_NB_ONE;
                                pixel_count   <= (others => '0');
                            elsif byte_data_o = x"02" then   -- Mode 1: Training
                                is_training_sig   <= '1';
                                current_state <= GET_PIXELS;
                            elsif byte_data_o = x"01" then  -- Mode 0: Inference
                                is_training_sig   <= '0';
                                current_state <= GET_PIXELS;
                            end if;
                        end if;

                    when GET_PIXELS =>
                        if byte_ready_o = '1' then
                            -- Binarize and write to BRAM
                            bram_addr <= pixel_count;
                            -- Binarize
                            if unsigned(byte_data_o) > 127 then
                                bram_data <= '1';
                            else
                                bram_data <= '0';
                            end if;
                            bram_we   <= '1';

                            if pixel_count = 783 then
                                if is_training_sig = '1' then
                                    current_state <= GET_LABEL;
                                else
                                    current_state <= DONE;
                                end if;
                            else
                                pixel_count <= pixel_count + 1;
                            end if;
                        end if;

                    when GET_LABEL =>
                        if byte_ready_o = '1' then
                            target_label  <= byte_data_o;
                            current_state <= DONE;
                        end if;
                        
                    when LOAD_WEIGHTS =>
                        if byte_ready_o = '1' then
                        
                            case current_weight_state is
                            
                                when WAITING_NB_ONE =>
                                    -- Capture bits 9-8 from first byte
                                    neuron_select_buffer(9 downto 8) <= unsigned(byte_data_o(1 downto 0));
                                    current_weight_state <= WAITING_NB_TWO;
                                    
                                when WAITING_NB_TWO =>
                                    -- Capture bits 7-0 from second byte
                                    neuron_select_buffer(7 downto 0) <= unsigned(byte_data_o);
                                    current_weight_state <= WAITING_AB_ONE;
                                    
                                when WAITING_AB_ONE =>
                                    addr_select_buffer(9 downto 8) <= unsigned(byte_data_o(1 downto 0));
                                    current_weight_state <= WAITING_AB_TWO;
                                    
                                when WAITING_AB_TWO =>
                                    addr_select_buffer(7 downto 0) <= unsigned(byte_data_o);
                                    current_weight_state <= WAITING_DATA_BYTE;
                                
                                when WAITING_DATA_BYTE =>
                                    weight_data <= byte_data_o;
                                    weight_addr <= addr_select_buffer;
                                    weight_neuron <= neuron_select_buffer;
                                    weight_we     <= '1';
                                    
                                    current_weight_state <= WAITING_NB_ONE;
                                    current_state <= WAIT_FOR_MODE;
                                    
                            end case;
                        end if;
                            
                    when DONE =>
                        image_ready   <= '1'; -- Trigger NN
                        current_state <= WAITING_BNN; -- Reset for next image
                        
                    when WAITING_BNN =>
                        if bnn_done = '1' then
                            tx_data_i <= "0000" & bnn_prediction;
                            tx_load <= '1';
                            current_state <= FINISH_BNN;
                            image_ready <= '0';
                        end if;
                    
                    when FINISH_BNN =>
                        current_state <= WAIT_FOR_MODE;
                        image_ready <= '0';
                        
                    when WAIT_PHASE =>
                        if byte_ready_o = '1' then
                            current_state <= SEND_STATUS;
                        end if;
                        
                    when SEND_STATUS =>
                        tx_data_i <= x"AA";
                        tx_load <= '1';
                        current_state <= SEND_STATUS_WAIT;
                        
                    when SEND_STATUS_WAIT =>
                        tx_load <= '0';
                        if byte_ready_o = '1' and byte_data_o = x"AA" then
                            current_state <= SEND_WEIGHTS;
                        end if;
                        
                    when SEND_WEIGHTS =>
                        tx_data_i <= weight_data_in;
                        --tx_data_i <= x"47";
                        tx_load <= '1';
                        current_state <= NEXT_WEIGHT_RDY;
                        
                    when NEXT_WEIGHT_RDY =>
                        tx_load <= '0';
                        if byte_ready_o = '1' and byte_data_o = x"05" then 
                            if neuron_select_r = 265 and weight_addr_r = 255 then
                                current_state <= WAIT_FOR_MODE;
                            elsif neuron_select_r <= 255 and weight_addr_r = 783 then
                                neuron_select_r <= neuron_select_r + 1;
                                weight_addr_r <= (others => '0');
                                current_state <= WEIGHT_DELAY;
                            elsif neuron_select_r >= 256 and weight_addr_r = 255 then
                                neuron_select_r <= neuron_select_r + 1;
                                weight_addr_r <= (others => '0');
                                current_state <= WEIGHT_DELAY;
                            else 
                                weight_addr_r <= weight_addr_r + 1;
                                current_state <= WEIGHT_DELAY;
                            end if;
                        end if;
                        
                    when WEIGHT_DELAY =>
                        current_state <= WEIGHT_DELAY2;
                    
                    when WEIGHT_DELAY2 =>
                        current_state <= WAIT_PHASE;
                    
                end case;
            end if;
        end if;
    end process;
    
    weight_addr_in <= weight_addr_r;
    neuron_select_in <= neuron_select_r;

end Behavioral;
