-- Create the "chats" table
CREATE TABLE public.chats (
    smid INTEGER NOT NULL DEFAULT nextval('chats_smid_seq'::regclass),
    system_message TEXT,
    model_state JSONB,
    user_id INTEGER,
    name TEXT,
    CONSTRAINT chats_pkey PRIMARY KEY (smid)
);


-- Create the "chats_smid_seq" sequence
CREATE SEQUENCE public.chats_smid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 2147483647
    CACHE 1;

ALTER SEQUENCE public.chats_smid_seq OWNED BY public.chats.smid;

-- Create the "messages" table
CREATE TABLE public.messages (
    id INTEGER NOT NULL DEFAULT nextval('messages_id_seq'::regclass),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    role CHARACTER VARYING(20),
    smid BIGINT,
    chat_id INTEGER,
    audio_url TEXT,
    CONSTRAINT messages_pkey PRIMARY KEY (id),
    CONSTRAINT fk_messages_chat_id FOREIGN KEY (chat_id) REFERENCES public.chats (smid)
);

-- Create the "messages_id_seq" sequence
CREATE SEQUENCE public.messages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 2147483647
    CACHE 1;

ALTER SEQUENCE public.messages_id_seq OWNED BY public.messages.id;

-- Create the "saved_system_messages" table
CREATE TABLE public.saved_system_messages (
    id INTEGER NOT NULL DEFAULT nextval('saved_system_messages_id_seq'::regclass),
    content TEXT NOT NULL,
    CONSTRAINT saved_system_messages_pkey PRIMARY KEY (id),
    CONSTRAINT saved_system_messages_content_key UNIQUE (content)
);

-- Create the "saved_system_messages_id_seq" sequence
CREATE SEQUENCE public.saved_system_messages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 2147483647
    CACHE 1;

ALTER SEQUENCE public.saved_system_messages_id_seq OWNED BY public.saved_system_messages.id;

-- Create indexes
CREATE INDEX idx_chats_user_id ON public.chats (user_id);
CREATE INDEX idx_messages_chat_id ON public.messages (chat_id);
-- Add a new column "image_url" to the "messages" table
ALTER TABLE public.messages ADD COLUMN image_url TEXT;